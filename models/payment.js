const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  april: {
    type: JSON,
  },
  may: {
    type: JSON,
  },
  june: {
    type: JSON,
  },
  july: {
    type: JSON,
  },
  august: {
    type: JSON,
  },
  september: {
    type: JSON,
  },
  october: {
    type: JSON,
  },
  november: {
    type: JSON,
  },
  december: {
    type: JSON,
  },
  january: {
    type: JSON,
  },
  february: {
    type: JSON,
  },
  march: {
    type: JSON,
  },
  other: {
    type: JSON,
  },
  otherDue:{
    type: JSON,
  },
  dueAmount:{
    type: Number
  },
  excessAmount:{
    type: Number
  },
  totalFineAmount:{
    type: Number
  },
  oldSessionDue:{
    type: Number
  },
  userId: {
    type: String,
  },
  session: {
    type: String,
  },
  class: {
    type: String,
  },
  created: {
    type: Date,
  },
  modified: {
    type: Date,
  },
  deleted: {
    type: Boolean,
    default: false,
  },
});

paymentSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

paymentSchema.set("toJSON", {
  virtuals: true,
});

paymentSchema.pre("save", function (next) {
  const now = new Date();
  this.modified = now;
  if (!this.created) {
    this.created = now;
  }
  next();
});

exports.paymentModel = mongoose.model("payment", paymentSchema);
exports.paymentSchema = paymentSchema;
