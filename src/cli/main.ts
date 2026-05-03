import { Cli, friendlyErrorPlugin } from 'clerc'
import pkg from '~~/package.json'
import { convert } from './convert'

export default Cli()
  .scriptName(pkg.name.split('/').pop()!)
  .description(pkg.description)
  .version(pkg.version)
  .use(friendlyErrorPlugin())
  .command(convert)
