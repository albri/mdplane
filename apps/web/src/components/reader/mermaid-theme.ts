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

const BRAND = {
  amber: '#E8A851',
  amberLight: '#FDF6E9',
  amberDark: '#3D2E1A',
  terracotta: '#D97757',
  terracottaLight: '#FCF0EC',
  terracottaDark: '#3A211A',
  sage: '#8B9A8B',
  sageLight: '#F2F4F2',
  sageDark: '#252A25',
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
        primaryColor: BRAND.amberDark,
        nodeTextColor: '#fafafa',
        primaryTextColor: '#fafafa',
        primaryBorderColor: BRAND.amber,
        secondaryColor: BRAND.sageDark,
        secondaryTextColor: '#fafafa',
        secondaryBorderColor: BRAND.sage,
        tertiaryColor: '#1f1f1f',
        tertiaryTextColor: '#fafafa',
        tertiaryBorderColor: '#404040',
        lineColor: '#a3a3a3',
        textColor: '#fafafa',
        clusterBkg: '#1f1f1f',
        clusterBorder: BRAND.sage,
        nodeBorder: BRAND.amber,
        edgeLabelBackground: '#171717',
        noteBkgColor: BRAND.terracottaDark,
        noteTextColor: '#fafafa',
        noteBorderColor: BRAND.terracotta,
      },
      themeCSS: `
        .node rect,
        .node .label-container {
          rx: 4px;
          ry: 4px;
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
      background: '#FDFBF7',
      fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
      primaryColor: BRAND.amberLight,
      nodeTextColor: '#1A1A1A',
      primaryTextColor: '#1A1A1A',
      primaryBorderColor: BRAND.amber,
      secondaryColor: BRAND.sageLight,
      secondaryTextColor: '#1A1A1A',
      secondaryBorderColor: BRAND.sage,
      tertiaryColor: '#ffffff',
      tertiaryTextColor: '#1A1A1A',
      tertiaryBorderColor: '#d4d4d4',
      lineColor: '#525252',
      textColor: '#1A1A1A',
      clusterBkg: '#fafafa',
      clusterBorder: BRAND.sage,
      nodeBorder: BRAND.amber,
      edgeLabelBackground: '#FDFBF7',
      noteBkgColor: BRAND.terracottaLight,
      noteTextColor: '#1A1A1A',
      noteBorderColor: BRAND.terracotta,
    },
    themeCSS: `
      .node rect,
      .node .label-container {
        rx: 4px;
        ry: 4px;
      }
    `,
  }
}

