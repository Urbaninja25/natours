//these here expose a function right away and usually what we do then is to pass our secret key right into that so it will give use stripe object that we can work with
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/userModel');
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
    //!!!!!!!!!!!!!!!!!!!!!! stap 1
    success_url: `${req.protocol}://${req.get('host')}/my-tours?alert=booking`,
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
            images: [
              `${req.protocol}://${req.get('host')}/img/tours/${
                tour.imageCover
              }`,
            ],
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
const createBookingCheckout = async (session) => {
  const tour = session.client_reference_id;
  const user = (await User.findOne({ email: session.customer_email }))._id;
  const { price } = await Tour.findOne({ _id: session.client_reference_id }); //// FIX !
  await Booking.create({ tour, user, price });
};

//that function is the one  the one that gets called once Stripe calls our webhook.
exports.webhookCheckout = (req, res, next) => {
  //The first thing that we need to do is to read this Stripe signature out of our headers,so signature and then request.Basically when Stripe calls our webhook,it will add a header to that request containing a special signature for our webhook.
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      //remember that this body here needs to be in the raw form,
      req.rawBody,
      //So, you see, all of this is really to make the process super, super secure.We need all of this data like the signature and also the secret in order to basically validate the data that comes in the body
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    //In case there is an error,we want to send back an error to Stripe,
    console.log(`Error message: ${err.message}`);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }
  //Now we're checking if that is really the event that we are receiving here just to be 100% sure.
  if (event.type === 'checkout.session.completed')
    createBookingCheckout(event.data.object);

  res.status(200).json({ received: true });
};

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
