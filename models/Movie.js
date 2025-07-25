const mongoose = require("mongoose");
const genreSchema = require("./Genre");

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  genres: [{ type: mongoose.Schema.Types.ObjectId, ref: "Genre", required: true }],
  description: { type: String },
  director: { type: String },
  actors: { type: [String] },
  year: { type: Number },
  runtime: { type: Number },
  rating: { type: Number },
  votes: { type: Number },
  revenue: { type: Number },
});

const Movie = mongoose.model("Movie", movieSchema);

module.exports = Movie;
