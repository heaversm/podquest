import mongoose from 'mongoose';

const PodcastUsers = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: '',
  },
});

export default mongoose.model('PodcastUsers', PodcastUsers);
