const express = require('express');
const authController = require('../controllers/authController');
const tourController = require('../controllers/tourController');
const reviewRouter = require('../routes/reviewRoutes');

//--router
const router = express.Router();

//-------routes

router.use('/:tourId/review', reviewRouter);
router
  .route('/top-5-cheap')
  .get(tourController.aliasTopTours, tourController.getAllTours);

router.route('/tour-stats').get(tourController.getTourStats);

router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan
  );

router
  //latlng ამ შემტხვევაში არის შენი კოორდინატები ვისაც გაინტერესებეს რა მანძილში არი ტუეებუ=ი და აშ ნუ რასაც აიმპიმენტირებ აქ
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(tourController.getToursWithin);
//---- ასეთი სტრინგის ჩაწერა არ მოუწევს უზერს აქ რო რამე (ეს ახალია!)
// /tours-within?distance=233&center=-40,45&unit=mi
//--- ასე ჩაწერს რაც ჯონასის აზრით უფრო ლამაზია და სტანდარტიც ესააო
// /tours-within/233/center/-40,45/unit/mi

router.route('/distances/:latlng/unit/:unit').get(tourController.getDistances);

router
  .route('/')
  .get(tourController.getAllTours)
  .post(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.createTour
  );
router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    //!!!!!!!!!!!!!!!!!!!!
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.uploadTourImages,
    tourController.resizeTourImages,
    tourController.updateTour
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour
  );

//----we export like these when we only export one thing like defoult
module.exports = router;
