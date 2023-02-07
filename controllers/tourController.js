const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

//-------------multer

//store in memory
const multerStorage = multer.memoryStorage();

//filter
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

//store in memory with filter
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

//---if we have mix
exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

//--if we have onlu one filed with one image to upload
// upload.single('image') req.file
//--if we only have one filed which accepts multiple imagies at the same time we should do it like that.5 ის maxcount
// upload.array('images', 5) req.files

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  console.log(req.files);

  //in case there are no imagies move to next middlware
  if (!req.files.imageCover || !req.files.images) return next();

  // 1) Cover image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    //3x2 ratio
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) Images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    })
  );

  next();
});

//--------------
exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getTour = factory.getOne(Tour, { path: 'reviews' });

exports.getAllTours = factory.getAll(Tour);

exports.createTour = factory.createOne(Tour);

exports.updateTour = factory.updateOne(Tour);

exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' },
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 },
    },
    // {
    //   $match: { _id: { $ne: 'EASY' } }
    // }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1; // 2021

  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates',
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    {
      $addFields: { month: '$_id' },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: { numTourStarts: -1 },
    },
    {
      $limit: 12,
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});

//------!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
/// /tours-within/:distance/center/:latlng/unit/:unit
// /tours-within/233/center/34.111745,-118.113491/unit/mi
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  //get all coordinats from this.as us see we expect data to a format like that(34.111745,-118.113491)
  const [lat, lng] = latlng.split(',');
  //radius უნდა იყოს დაკონვერტირებული radians ში .ასე ესმის geospecial operator ს
  //3963.2 - radius of the earth in miles
  //და თუ კილომეტრებში გვაინტერესებს ანუ unit თუ კილომეტრი იქნება - 6378.1;
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitutr and longitude in the format lat,lng.',
        400
      )
    );
  }

  //geospecial location ის query ძალიან გავს ჩვენს სტანდარტულ query ის
  const tours = await Tour.find({
    startLocation: {
      //value that we are searching for.
      //geowithin - geospecial operator(როგორც ადრე გამოვიყენეთ math operator ი gt ls და რაღაცეეები ეხა გამოვიყენეებთ geospecial data ს )
      //so geowithin ით ჩვენ ვეძებთ location ს მაგრამ აუცილებელი იყო განგვემარტებინა რო მე ვეძებ რაღაცას მაგრამ ვიმყოფები აქა და აქ და ამ რადიუსში ვეძებ ჩემგან .ამის სათქმელად დაგვჭირდდა geowithin ის იობჯექტში მყოფი ობჯექტი.
      //so centersphare revives arr of  radius and coordinats
      $geoWithin: { $centerSphere: [[lng, lat], radius] },
    },
  });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  //0.000621371- 1 metre in miles
  // 0.001 - 1 miture in km

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitutr and longitude in the format lat,lng.',
        400
      )
    );
  }

  const distances = await Tour.aggregate([
    //in geospecial agregation there is only one single stage and thats called geonear

    {
      //geonear should be alwas on first stage
      //geonear requires that at least one of our fields contains a geospeccial(as u know startlocation already have these 2dspheare index) index
      //if there is one field with geospecial index(as in our example ) then this geonear stage here will automatically use that index in order to preform calculation,but if u have multiple fields with geospecial indexes then u need to use the keys parameter in order to define a field that u want to use for calculations
      $geoNear: {
        //near is the point from which to calclate the distances.so all the distances will be calculated from this point to all the start locations
        near: {
          type: 'Point',
          //*1 to convert it to numbers
          coordinates: [lng * 1, lat * 1],
        },
        //this is the name of the field that will be created and where all the calculated distances will be stored
        distanceField: 'distance',
        //here we can specify a number which is then going to be multiplied with all the distancies
        distanceMultiplier: multiplier,
      },
    },
    //projectt stage  ი გვეხმარება ამ აგრეაგატიონ ის მიერ მოწოდებული დატადან დავიტოვოთ და დავფოკუსირდეთ მხოლოდ იმაზე რაც გვინდა
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
