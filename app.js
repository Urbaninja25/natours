const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
// const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const AppError = require('./utils/appError');
const globalErrorhandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');
const bookngRouter = require('./routes/bookingRoutes');

const app = express();

app.set('view engine', 'pug');

app.set(
  'views',
  //./views
  path.join(__dirname, 'views')
);

//1) GLOBAL MIDDLEWARES
// --------------------Serving static files
app.use(express.static(`${__dirname}/public`));

// -----------------Set security HTTP headers
//SO AQ HELMETS VUQENI NAXUI IMITORO VEGAR GAVIGE RA UNDA MEQNA RO EMUSHAVA WESIERAD .AMITOM NAXUI DA AMAS UNDA MIUBRUNDE KURSIS BOLOS
// app.use(
//   helmet.contentSecurityPolicy({
//     directives: {
//       defaultSrc: ["'self'", 'https:', 'http:', 'data:', 'ws:'],
//       baseUri: ["'self'"],
//       fontSrc: ["'self'", 'https:', 'http:', 'data:'],
//       scriptSrc: ["'self'", 'https:', 'http:', 'blob:'],
//       styleSrc: ["'self'", "'unsafe-inline'", 'https:', 'http:'],
//     },
//   })
// );
//-------------------------------------------
// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
//---- --------------Limit requests from same API

const limiter = rateLimit({
  max: 100,
  //so its allowed 100 requets per hour
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});

app.use('/api', limiter);
//-------------------- Body parser, reading data from body
app.use(express.json({ limit: '10kb' }));
//!!!!!!!!couse we need to parse data coming from the form before request resconce cycle finished
//and it still express built in middlwware + and it called these way "urlencoded" couse the way form sends data to the server is actually also called URL encoded.
// app.use(express.urlencoded({ extended: true, limit: '10kb' }));

//----------------cookie parser
//!!!!!!!!!!!!
app.use(cookieParser());
//---------------- Data sanitization against NoSQL query injection

app.use(mongoSanitize());

// ---------------Data sanitization against XSS

app.use(xss());
// these one should be use in the end becouse what it does is to clear up the query string
// Prevent parameter pollution
app.use(
  hpp({
    //propertys that we allow to duplicate in qyery string
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

// --------------------Test middleware
//!!!!!!!!!!!!!!!!!these way we will always dispay all the cookie in the console
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});
//----------------------routes

//!!!!!!!!!!
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
//!!!!!
app.use('/api/v1/bookings', bookngRouter);
//------------------------------------------create unhandled error
app.all('*', (req, res, next) => {
  next(new AppError('cant find these route on the server', 400));
});
app.use(globalErrorhandler);

//export app(application) for server.js
module.exports = app;