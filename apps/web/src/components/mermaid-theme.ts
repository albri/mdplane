export interface MermaidThemeVariables {
  darkMode: boolean
  background: string
  fontFamily: string
  primaryColor: string
  nodeTextColor: string
  primaryTextColor: string
  primaryBorderColor: string
  secondaryColor: string
  secondaryTextColor: string
  secondaryBorderColor: string
  tertiaryColor: string
  tertiaryTextColor: string
  tertiaryBorderColor: string
  lineColor: string
  textColor: string
  clusterBkg: string
  clusterBorder: string
  nodeBorder: string
  edgeLabelBackground: string
  noteBkgColor: string
  noteTextColor: string
  noteBorderColor: string
}

export interface MermaidInitializeConfig {
  startOnLoad: false
  securityLevel: 'strict'
  theme: 'base'
  themeVariables: MermaidThemeVariables
  themeCSS: string
}

export function getMermaidInitializeConfig(isDark: boolean): MermaidInitializeConfig {
  if (isDark) {
    return {
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        darkMode: true,
        background: '#171717',
        fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
        primaryColor: '#222d12',
        nodeTextColor: '#fafafa',
        primaryTextColor: '#fafafa',
        primaryBorderColor: '#65a30d',
        secondaryColor: '#1f1f1f',
        secondaryTextColor: '#fafafa',
        secondaryBorderColor: '#404040',
        tertiaryColor: '#1f1f1f',
        tertiaryTextColor: '#fafafa',
        tertiaryBorderColor: '#404040',
        lineColor: '#a3a3a3',
        textColor: '#fafafa',
        clusterBkg: '#1f1f1f',
        clusterBorder: '#404040',
        nodeBorder: '#65a30d',
        edgeLabelBackground: '#171717',
        noteBkgColor: '#1f1f1f',
        noteTextColor: '#fafafa',
        noteBorderColor: '#525252',
      },
      themeCSS: `
        .node rect,
        .node .label-container {
          rx: 10px;
          ry: 10px;
        }
      `,
    }
  }

  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      darkMode: false,
      background: '#f5f5f5',
      fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
      primaryColor: '#f1f8df',
      nodeTextColor: '#0d0d0d',
      primaryTextColor: '#0d0d0d',
      primaryBorderColor: '#65a30d',
      secondaryColor: '#e5e5e5',
      secondaryTextColor: '#171717',
      secondaryBorderColor: '#a3a3a3',
      tertiaryColor: '#ffffff',
      tertiaryTextColor: '#171717',
      tertiaryBorderColor: '#d4d4d4',
      lineColor: '#525252',
      textColor: '#0d0d0d',
      clusterBkg: '#fafafa',
      clusterBorder: '#a3a3a3',
      nodeBorder: '#65a30d',
      edgeLabelBackground: '#f5f5f5',
      noteBkgColor: '#ecfccb',
      noteTextColor: '#171717',
      noteBorderColor: '#a3a3a3',
    },
    themeCSS: `
      .node rect,
      .node .label-container {
        rx: 10px;
        ry: 10px;
      }
    `,
  }
}
