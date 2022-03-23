export function formData (form) {
  const data = {}
  new FormData(form).forEach((v, k) => {
    data[k] = v
  })
  return data
}
