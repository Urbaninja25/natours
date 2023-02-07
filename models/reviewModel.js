const mongoose = require('mongoose');
///!!!!!!!!!!!!!!
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },

    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//!!!!!!!! not really imoortant 1 or -1 here (tour: 1, user: 1 )
//after these code each combinatiions of tour and user has always to be unique.so ახალი რივიუს დაწერისას user and tour should be unique .
reviewSchema.index(
  { tour: 1, user: 1 },
  //options object
  { unique: true }
);

reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',

    select: 'name photo',
  });
  next();
});

//that tour id is tour which current review belongs to
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  // console.log(stats);

  //!!!!!!!!!!!
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      //set defoult  value when there is no reviews at all
      ratingsAverage: 4.5,
    });
  }
};

reviewSchema.post('save', function () {
  // this points to current review(current doc)

  this.constructor.calcAverageRatings(this.tour);
});

//-------!!!!!!!!!!!!!!!
// findByIdAndUpdate
// findByIdAndDelete
reviewSchema.pre(/^findOneAnd/, async function (next) {
  //remmeber that goal is to get access to a current review doc
  this.r = await this.findOne();

  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  // await this.findOne(); does NOT work here, query has already executed
  //this.r.constructor - current model
  await this.r.constructor.calcAverageRatings(this.r.tour);
});
//----------
const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
