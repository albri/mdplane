// /demo: the reader on the recorded sample session.
import { mountApp } from './app.ts'
import { sampleSession } from './sample.ts'

const app = mountApp()
const sample = await sampleSession()
app.title(sample.name ?? sample.workspaceId, [sample.path], sample.path)
app.reader.load(sample)
