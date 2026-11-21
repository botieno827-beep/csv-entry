const LF = 10, CR = 13, QUOTE = 34, COMMA = 44;

export function run(input) {
  const text = String(input.text);
  const hasHeader = input.header === true;
  const length = text.length;
  const rows = [];
  const errors = [];
  let columns = null;
  let width = 0;
  let start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let nextQuote = text.indexOf('"', start);
  let nextCR = text.indexOf('\r', start);

  while (start < length) {
    const recordLine = line;
    const row = hasHeader && columns === null ? null : rows.length;
    const lf = text.indexOf('\n', start);
    const end = lf === -1 ? length : lf;
    const endWithCR = lf !== -1 && text.charCodeAt(end - 1) === CR ? end - 1 : end;
    let fields;
    let quoted = false;
    if ((nextQuote === -1 || nextQuote >= end) && (nextCR === -1 || nextCR >= endWithCR)) {
      // The physical line is also a logical record; split its raw fields at once.
      fields = endWithCR > start ? text.slice(start, endWithCR).split(',') : null;
      start = end + 1;
      line++;
    } else {
      fields = [];
      let pos = start;
      let c;
      do {
        c = text.charCodeAt(pos);
        const open = pos;
        quoted = c === QUOTE;
        let value = '';
        let closed = false;

        if (quoted) {
          let quote = text.indexOf('"', pos + 1);
          while (quote !== -1 && text.charCodeAt(quote + 1) === QUOTE) {
            quote = text.indexOf('"', quote + 2);
          }
          if (quote === -1) {
            errors.push({ code: 'unterminated_quote', line: recordLine, row });
          } else {
            value = text.slice(open + 1, quote);
            let breaks = 0;
            for (let i = open + 1; i < quote; i++) {
              c = text.charCodeAt(i);
              if (c === CR) {
                i += text.charCodeAt(i + 1) === LF ? 1 : 0;
                breaks++;
              } else if (c === LF) {
                breaks++;
              }
            }
            if (breaks !== 0) {
              line += breaks;
              value = value.replace(/\r\n?/g, '\n');
            }
            value = value.replaceAll('""', '"');
            pos = quote + 1;
            closed = true;
          }
        }
        let part = pos;
        let added = false;
        for (; pos < length; pos++) {
          c = text.charCodeAt(pos);
          if (c === COMMA || c === LF || (c === CR && text.charCodeAt(pos + 1) === LF)) {
            break;
          }
          if (c === CR) {
            if (part < pos) {
              added = true;
              value += text.slice(part, pos);
            }
            errors.push({ code: 'stray_cr', line: recordLine, row });
            part = pos + 1;
          }
        }
        if (part < pos) {
          added = true;
          value += text.slice(part, pos);
        }
        if (closed && added) errors.push({ code: 'quote_junk', line: recordLine, row });
        fields.push(value);
        if (pos === length) break;
        pos++;
        if (c !== COMMA) {
          if (c === CR) pos++;
          line++;
        }
      } while (c === COMMA);
      start = pos;
    }
    if (nextQuote !== -1 && nextQuote < start) nextQuote = text.indexOf('"', start);
    if (nextCR !== -1 && nextCR < start) nextCR = text.indexOf('\r', start);

    if (fields === null || (fields.length === 1 && fields[0] === '' && !quoted)) continue;
    if (width === 0) width = fields.length;
    if (row === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: hasHeader ? (columns ?? []) : null, rows, errors };
}
