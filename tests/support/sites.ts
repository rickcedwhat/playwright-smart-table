import path from 'path';
import { pathToFileURL } from 'url';

/**
 * Third-party demo sites used by the README and integration specs.
 *
 * PR CI runs against local replicas (built from the original markup/sources) so it never
 * depends on someone else's uptime. `playwright.config.live.ts` sets SMART_TABLE_LIVE_SITES=1
 * to run the same specs against the real sites as a non-blocking drift check.
 */
export const LIVE_SITES = process.env.SMART_TABLE_LIVE_SITES === '1';

const asset = (relative: string) =>
  pathToFileURL(path.resolve(__dirname, '../test-assets', relative)).href;

export const SITES = LIVE_SITES
  ? {
      datatablesDom: 'https://datatables.net/examples/data_sources/dom',
      htmxInfiniteScroll: 'https://htmx.org/examples/infinite-scroll/',
      muiTableDocs: 'https://mui.com/material-ui/react-table/',
      glideAddData:
        'https://glideapps.github.io/glide-data-grid/iframe.html?viewMode=story&id=glide-data-grid-dataeditor-demos--add-data&globals=',
    }
  : {
      datatablesDom: asset('datatables-dom/index.html'),
      htmxInfiniteScroll: asset('htmx-infinite-scroll/index.html'),
      muiTableDocs: 'http://localhost:3070/',
      glideAddData: 'http://localhost:3080/',
    };
