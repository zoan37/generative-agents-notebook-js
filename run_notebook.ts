import { runNotebook } from './src/notebook';
import { getLocalConfig } from './local_config';

runNotebook(getLocalConfig());