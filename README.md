# Podquest

Answers to any question about your favorite podcast episodes.

## How it works

Podquest searches and retrieves podcast episodes from the [open source podcast index](https://podcastindex.org/).

It then grabs those mp3 urls, downloads them, and transcribes them with the open-source [whisper API](https://platform.openai.com/docs/guides/speech-to-text).

With that transcript, it then creates embeddings which it stores in a vector database.

A user can then query the textual content of the selected podcast episode using an AI large language model. ChatGPT is the LLM model currently, though I will be looking to replace that with a responsible open source alternative.

Podquest checks the user query against the vector database using [FAISS](https://github.com/facebookresearch/faiss) to find the closest "answer" to the users query.

[Langchain](https://github.com/hwchase17/langchainjs/) is used to orchestrate all of the various pieces.

## Modes

There are 2 modes in the experience:

* Questions mode: A simple query mode that answers questions about what was said in the podcast.
* Jump mode: Implements a podcast player, and allows you to ask questions about when something was discussed in the podcast, and skip to the point where it was mentioned.

## Feedback

I would love contributions, questions, feedback, anything. Please feel free to open an issue or PR.

