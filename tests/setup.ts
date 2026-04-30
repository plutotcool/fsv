import './polyfills/EncodedVideoChunk'

import { Log } from 'node-av'
import { AV_LOG_QUIET } from 'node-av/constants'

// Suppress ffmpeg internal logs (encoder stats, codec info, etc.) during tests
Log.setLevel(AV_LOG_QUIET)
