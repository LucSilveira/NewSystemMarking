// Aceita somente o formato XLSX para o leitor do CIS.
export function isCisXlsx(file) {
  return Boolean(file && typeof file.name === 'string' && /\.xlsx$/i.test(file.name));
}
