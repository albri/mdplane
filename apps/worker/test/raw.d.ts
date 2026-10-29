// Vite imports a file with `?raw` as its text.
declare module '*?raw' {
  const text: string
  export default text
}
