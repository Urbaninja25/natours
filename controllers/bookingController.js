//these here expose a function right away and usually what we do then is to pass our secret key right into that so it will give use stripe object that we can work with
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const Booking = require('../models/bookingModel');
const factory = require('./handlerFactory');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get the currently booked tour
  const tour = await Tour.findById(req.params.tourId);
  // console.log(tour);

  // 2) Create checkout session
  //there should be await couse these method actuall create an api call into stripe and call it
  const session = await stripe.checkout.sessions.create({
    //object of options
    payment_method_types: ['card'],
    //url that will get called as soon as the credit card has succesfuly been charged
    //!!!!!!!!!!!!!!!!!!!!!!
    success_url: `${req.protocol}://${req.get('host')}/?tour=${
      req.params.tourId
    }&user=${req.user.id}&price=${tour.price}`,
    //page where the user goes if they choose to cancel current payment.so let them go to tour page where they been previosly
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    //these option is very handy becouse ofc we already have access to the customers email and so with these we can save the user one step and make the checkout experience a lot smoother.so couse of protected route we have access on the current user
    customer_email: req.user.email,
    //these field is gonna allow us to pass in some data about the session that we are currently creating and thats important becouse later once the purchase was successful we will then get acess to the session object again.and by then we want to create a new booking in our database(დიაგრამა რომელიც წინა ლექციაზე განა აი მაგის ბოლო სთეფხე საუბარი რომელიც მხოლოდ deployment ის მერე მუშაობს ).
    //to create a new booking in pur db we will need the users ID ,the tour ID, and the price. ?????????????????????(11:40 ლექციაზე)
    client_reference_id: req.params.tourId,
    //spesify some details about product itself,wich accepts arr of objects .so basically one per item,so in our case there is only one
    line_items: [
      //these fied is mandatory to be named like that
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${tour.name} Tour`,
            description: tour.summary,
            //now these imagies here they need to be live imagies so basically imagies that are hosted on the internet,becouse stripe will actually upload this image to their own server.so ამასაც როცა დიფლოის გავაკეთებთ მერე ჩავსვავთ ამ ლინკს ახლა placeholder ად გვქონდეს აქ  ეს რაც არის natours.dev იდან აღებული.მივიდა base ში და ერთერთ card თან მიიწანა კურსორი.მერე inspect it and from html copy img link adress და ესე გადავაკეთე .რეალურად სწორეა იმიტორო public ში ზუსტად ეგრე მიდის path,- public/img/tours/imagecover name
            images: [`https://www.natours.dev/img/tours/${tour.imageCover}`],
          },
          unit_amount: tour.price * 100,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
  });

  // 3) Create session as response
  res.status(200).json({
    status: 'success',
    session,
  });
});
//!!!!!!!!!!!!!!!!!!!
//these function create new booking in the database
exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  // This is only TEMPORARY, because it's UNSECURE: everyone can make bookings without paying
  const { tour, user, price } = req.query;
  //აქ გავდივართ სტანდარტულ პრცედურას რომ თუ ესენი არასებობს გადადი next middlware ზე.თუმცა რაარის next middlware actually?well remember that we want to create a new booking on these home url (look at success_url in sessions).and so what we need to do is to add this middlware function(createbookingchheckout)onto the middlware stack of these route handler
  if (!tour || !user || !price) {
    return next();
  }
  await Booking.create({ tour, user, price });
  //with these we make pur temporaru solution a little more secure.so ამას როგორც ვაღწევთ არი რო რედაირექტს ვუკეთებთ overviu url ზე ოღონდ query string ის გარეშე რო ეს quary სტრინგი არ იყოს ესე მარტივად ხელმისაწვდომი.so როგორც ლოგიკა მოიქცევა არი რო თავიდან თავისი params ით და url ში მოცემული user dataთუ დაეტაკება "/" url ს ჩაირთვება ეს middlware ი რომელიც შექმნის ბუუქიგს და გააკეთებს redirects .redirect რო მოხდება შემდგომ if check ს ვეღარ გავივლით ცხადია იმიტორო req.query ს აღარ ექნება დატა და დაიქოლება next middlware ი რომელიც finally დაარენდერებს overview page ს
  res.redirect(req.originalUrl.split('?')[0]);
});

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
