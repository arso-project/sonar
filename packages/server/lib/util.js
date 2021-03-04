exports.HttpError = function (code, message) {
  let err
  if (message instanceof Error) err = message
  else err = new Error(message)
  err.statusCode = code
  return err
}
