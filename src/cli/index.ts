#!/usr/bin/env node

import { Cli, friendlyErrorPlugin } from 'clerc'
import pkg from '~~/package.json'
import { convert } from './convert'

Cli()
  .scriptName(pkg.name.split('/').pop()!)
  .description(pkg.description)
  .version(pkg.version)
  .use(friendlyErrorPlugin())
  .command(convert)
  .parse()
