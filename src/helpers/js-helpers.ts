export const onlyDefined = (o: {[key: string]: any}): any => {
  const out: any = {}

  for (const k in o) {
    if (o[k]) {
      out[k] = o[k]
    }
  }

  return out
}
