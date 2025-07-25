const { gql } = require("apollo-server");

const typeDefs = gql`
  type Genre {
    id: ID!
    name: String!
  }

  type Movie {
    id: ID!
    title: String!
    genres: [Genre!]!
    description: String
    director: String
    actors: [String]
    year: Int
    runtime: Int
    rating: Float
    votes: Int
    revenue: Float
  }

  type Query {
    getAllMovies: [Movie]
    getMovieByTitle(title: String!): Movie
  }

  type Mutation {
    createMovie(
      title: String!
      genreNames: [String!]!
      description: String
      director: String
      actors: [String]
      year: Int
      runtime: Int
      rating: Float
      votes: Int
      revenue: Float
    ): Movie
    updateMovie(
      title: String!
      genreNames: [String]
      description: String
      runtime: Int
      votes: Int
      rating: Float
    ): Movie
    deleteMovie(title: String!): String
  }
`;

module.exports = { typeDefs };
