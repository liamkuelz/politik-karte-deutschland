// File name of a politician's votes file (public/data/votes/<id>.json). The id comes from the API, so it is
// checked to be a positive integer before it becomes part of a path (no "../" or other path tricks).
export function voteFileName(pid) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error(`Invalid politician id for a votes file: ${JSON.stringify(pid)}`);
  return `${pid}.json`;
}
