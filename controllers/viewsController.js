const catchAsync = require('../utils/catchAsync');
const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
const Booking = require('../models/bookingModel');

//we add next here in order to make catchasync function work
exports.getOverview = catchAsync(async (req, res, next) => {
  // 1) Get tour data from collection
  const tours = await Tour.find();

  // 2) Build template(we are not gonna do that in these controller functioon but still its nice to visulize the steps here)
  // 3) Render that template using tour data from 1)
  res.status(200).render('overview', {
    title: 'All Tours',
    tours: tours,
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  // 1) Get the data, for the requested tour (including reviews and guides)

  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review rating user',
  });

  if (!tour) {
    return next(new AppError('There is no tour with that name.', 404));
  }

  // 2) Build template
  // 3) Render template using data from 1)
  res
    .status(200)
    //SO AQ HELMETS VUQENI NAXUI IMITORO VEGAR GAVIGE RA UNDA MEQNA RO EMUSHAVA WESIERAD .AMITOM NAXUI DA AMAS UNDA MIUBRUNDE KURSIS BOLOS
    // .set(
    //   'Content-Security-Policy',
    //   "default-src 'self' https://*.mapbox.com ;base-uri 'self';block-all-mixed-content;font-src 'self' https: data:;frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src https://cdnjs.cloudflare.com https://api.mapbox.com 'self' blob: ;script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests;"
    // )
    .render('tour', {
      title: `${tour.name} Tour`,
      tour,
    });
});

exports.getLoginForm = (req, res) => {
  res
    .status(200)
    //SO AQ HELMETS VUQENI NAXUI IMITORO VEGAR GAVIGE RA UNDA MEQNA RO EMUSHAVA WESIERAD .AMITOM NAXUI DA AMAS UNDA MIUBRUNDE KURSIS BOLOS
    // .set(
    //   'Content-Security-Policy',
    //   "connect-src 'self' https://cdnjs.cloudflare.com"
    // )
    .render('login', { title: 'Log into your account' });
};

exports.getAccount = (req, res) => {
  res.status(200).render('account', {
    //stap 3
    title: 'Your account',
  });
};

//!!!!!!!!!!!!!!!!!!!!!!!!!
exports.getMyTours = catchAsync(async (req, res, next) => {
  // 1) Find all bookings
  const bookings = await Booking.find({ user: req.user.id });

  // 2) Find tours with the returned IDs
  const tourIDs = bookings.map((el) => el.tour);
  //$in operator will select all the tours which have an id which is in the tourids array
  const tours = await Tour.find({ _id: { $in: tourIDs } });

  //ზემოთა კოდის მეშვეობით(in operator ის მეშვეობით)ჩვენ აქ ჩვანაცვლეთ მეორე ოფშენი რო გაგვეკეთებინა ეს ყველაფერი არა in operator ით არამედ vitual populate ის მეშვეობით.so notion ში ნახე აუცილებლად ეს როგორ უნდა გააკეთო note ებში ჩავწერ

  //we reusing overview template to render it
  res.status(200).render('overview', {
    title: 'My Tours',
    tours,
  });
});
