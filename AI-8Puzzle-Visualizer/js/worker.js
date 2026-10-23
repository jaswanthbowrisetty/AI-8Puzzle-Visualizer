/* worker.js — runs searches in the background so the page never freezes. */
importScripts("board.js", "frontier.js", "searches.js");

onmessage = function (event) {
  var job = event.data;
  try {
    postMessage({ ticket: job.ticket, result: Searches.run(job.key, job.start, job.goal, job.options) });
  } catch (err) {
    postMessage({ ticket: job.ticket, error: String(err.message || err) });
  }
};
