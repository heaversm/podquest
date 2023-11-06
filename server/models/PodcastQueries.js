import mongoose from 'mongoose';

const PodcastQueries = new mongoose.Schema({
  episodeRef: {
    type: String,
    required: true,
    default: '',
  },
  query: {
    type: String,
    required: true,
    default: '',
  },
  queryResponse: {
    type: String,
    required: false,
    default: '',
  },
  userRef: {
    type: String,
    required: false,
    default: '',
  },
});

export default mongoose.model('PodcastQueries', PodcastQueries);
