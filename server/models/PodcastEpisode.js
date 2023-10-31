import mongoose from 'mongoose';

const PodcastEpisode = new mongoose.Schema({
  episodeId: {
    type: String,
    required: true,
    default: '',
  },
  episodeUrl: {
    type: String,
    required: true,
  },
  episodeTitle: {
    type: String,
    required: true,
  },
  episodeTranscript: {
    type: String,
    required: false,
    default: '',
  },
});

export default mongoose.model('PodcastEpisode', PodcastEpisode);
