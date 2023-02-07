const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    //these expires property will make it so that the client will automaticcly delete the cookie after it has expired
    expires: new Date(
      //convert our experational cookie date in mileseconds
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),

    //so these will maike it so that the cookie cannot be accessed or modified in any way by the browser
    httpOnly: true,
  };
  //activate secure when we are in production
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  //actually send a cookie.then we specify name of the cookie (for eg "jwt"),then data that we wan to send and then options
  res.cookie('jwt', token, cookieOptions);

  // Remove password from output.როდესაც signup კეთდება create method იქოლება რომელიც schema ზე დაყრდნობით აყენებს პარამეტრებს request ის მიხედვით .მათ შორის ცხადია პასვორდს.მერე კი ბოლოში ამ user ს მიგზავნის response ად.მე კიდე ეს კოდი მეხმარება რო output ში დავმალო პასვორდი.
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  console.log(url);
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) If everything ok, send token to client

  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  //again the secret is to give cookie exact same name
  //ადრე თუ token ვუშვებდიტ ეხა ვუშვებთ რაიმე simple dummy text ,- like loggedout
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } //!!!!!!!!!!!
  else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE

  req.user = currentUser;
  //ამით ჩვენ ვაძლევთ pug ს ამ user varuable ს (Tu ar vcdebi)
  res.locals.user = currentUser; //stap 2
  next();
});

//!!!!!!!!!!!!!!!!!! Only for rendered pages, no errors(so there will be no err in these middlware)!
// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    //მოვაქციეთ try/catch ში ეს მთლიანი ბლოკი+ წავუშალეთ catchasync რათა global error handler ს არ დაეჭირა err  და ლოკალურად მოგვცემოდა
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      //!!!!!!!!!if there is an err simply say next .these way we catch error localy and not with help of global err handler
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

//----------------------------------------------------pass reset

//------------------------------------------stap one

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500
    );
  }
});

//-----------------------------------------------------stap 2
exports.resetPassword = catchAsync(async (req, res, next) => {
  // -------------------------1) Get user based on the token

  //encrypt the original token again so we can then compare it with the one that is stored(so the encrypted one on the database)
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    //if the expiration time is greater than now it means it hasnot yet expired.ამ check ის საშუალებას mongodb is method gt გვაძლევს
    passwordResetExpires: { $gt: Date.now() },
  });

  // --------------------------2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  //-------------------------- 3) Update changedPasswordAt property for the user
  //---------------------------4) Log the user in, send JWT
  createSendToken(User, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection(შევამოწმოთ user ისაა თუ არა ვისაც ამბობს რო არი რო მაგალითად კომპი ჩართუ თუ დაგრჩა სხვამ არ შეძლოს პაროლის შეცვლა )
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!და ეს ასე არი ორი მიზეზის გამო : 1) schema validator whouldnot be worked becouse when we update with findbyid we dont have access tio currentdocument so "this.password" which field is needed to actually run our validator.
  //2)so these field cant have our presave middlwares as well

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});
