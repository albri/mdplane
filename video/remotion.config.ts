import { Config } from '@remotion/cli/config'
import { inlineFonts } from './webpack.ts'

Config.setEntryPoint('src/index.ts')
Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
Config.setCodec('h264')
Config.setCrf(20)
Config.setX264Preset('slow')
Config.overrideWebpackConfig(inlineFonts)
