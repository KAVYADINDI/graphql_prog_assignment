const Movie = require("../models/Movie"); 
const Genre = require("../models/Genre");

const resolvers = {
  Query: {
    getAllMovies: async () => {
      try {
        return await Movie.find().populate({ path: "genres", select: "name" });
      } catch (err) {
        console.error("Detailed error:", err);
        throw new Error("Failed to fetch movies");
      }
    },
    getMovieByTitle: async (_, { title }) => {
      try {
        return await Movie.findOne({ title }).populate({ path: "genres", select: "name" });
      } catch (err) {
        console.error("Detailed error:", err);
        throw new Error("Movie not found");
      }
    },
  },

  Mutation: {
    createMovie: async (_, { title, genreNames, description, director, actors, year, runtime, rating, votes, revenue }) => {
      try {
        const genreList = Array.isArray(genreNames)
          ? genreNames
          : genreNames.split(",").map((name) => name.trim()).filter((name) => name);

        const genres = await Promise.all(
          genreList.map(async (name) => {
            let genre = await Genre.findOne({ name });
            if (!genre) {
              genre = new Genre({ name });
              await genre.save();
            }
            return genre._id;
          })
        );

        const newMovie = new Movie({
          title,
          genres,
          description,
          director,
          actors,
          year,
          runtime,
          rating,
          votes,
          revenue,
        });

        await newMovie.save();
        return await Movie.findById(newMovie._id).populate({ path: "genres", select: "name" });
      } catch (err) {
        console.error("Detailed error:", err);
        throw new Error("Failed to create movie");
      }
    },

    updateMovie: async (_, { title, genreNames, description, runtime, votes, rating }) => {
      try {
        let genres;
        if (genreNames) {
          const genreList = Array.isArray(genreNames)
            ? genreNames
            : genreNames.split(",").map((name) => name.trim()).filter((name) => name);

          genres = await Promise.all(
            genreList.map(async (name) => {
              let genre = await Genre.findOne({ name });
              if (!genre) {
                genre = new Genre({ name });
                await genre.save();
              }
              return genre._id;
            })
          );
        }

        const updatedMovie = await Movie.findOneAndUpdate(
          { title },
          { description, runtime, votes, genres, rating },
          { new: true }
        ).populate({ path: "genres", select: "name" });

        if (!updatedMovie) throw new Error("Movie not found");
        return updatedMovie;
      } catch (err) {
        console.error("Detailed error:", err);
        throw new Error("Failed to update movie");
      }
    },

    deleteMovie: async (_, { title }) => {
      try {
        const deletedMovie = await Movie.findOneAndDelete({ title });
        if (!deletedMovie) throw new Error("Movie not found");
        return `Movie with title "${title}" deleted successfully`;
      } catch (err) {
        console.error("Detailed error:", err);
        throw new Error("Failed to delete movie");
      }
    },
  },
};

module.exports = { resolvers };
