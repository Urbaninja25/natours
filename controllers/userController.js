const multer = require('multer');
const sharp = require('sharp');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

//----------------------------multer
//couse we want to save it in memory not in disk
// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });
//these way img save as buffer
const multerStorage = multer.memoryStorage();
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else
    cb(new AppError('NOT AN IMAGE! please upload only images', 400), false);
};

//configure multer upload
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  //that buffer is available like that ,- req.file.buffer
  await sharp(req.file.buffer)
    //spesify width and hight
    .resize(500, 500)
    //choose format
    .toFormat('jpeg')
    //compress little bit
    .jpeg({ quality: 90 })
    //in the end finally want to write it to a file on our disk
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

//-------------------------------------- filterobj
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

//-------------handlers

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  //remember that we only store img names in db not imgs itself.აქ კი ვაყალიბებ ლოგიკას რომ თუ მაქ req.file თქო და მაქ იმ შემთხვევაში თუ ფოტოს ვტვირთავ და წინა მიდლვეარი ჩაირთო,ეს გაფილტრული body სადაც name and email არი დარჩენილი მარტო ,აქ დაამატე ახალი property photo და იქ ატვირთე filename ი თქო.შემდგომ კი filteredbody ის object of propertys არი რასაც findByIdAndUpdate გამოიყენებს დასააფდეითებლად
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'success',

    message: 'please use signup noob its not avaliable for u dumbass',
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

//these is for administrators only ( update anything exept pass)
exports.updateUser = factory.updateOne(User);

exports.deleteUser = factory.deleteOne(User);
