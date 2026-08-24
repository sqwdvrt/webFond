import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe("request cache under the React Server Component dispatcher", () => {
  it("deduplicates within one request and resets for the next request", () => {
    const cacheModule = pathToFileURL(
      join(process.cwd(), "src/features/content-admin/request-cache.ts"),
    ).href;
    const flightServer = pathToFileURL(
      join(
        process.cwd(),
        "node_modules/next/dist/compiled/react-server-dom-webpack/server.node.js",
      ),
    ).href;
    const script = `
      import React from "react";
      import { renderToReadableStream } from ${JSON.stringify(flightServer)};
      import { createRequestCachedLoader } from ${JSON.stringify(cacheModule)};

      let calls = 0;
      const load = createRequestCachedLoader(async (slug) => {
        calls += 1;
        return slug;
      });

      async function Request({ slug }) {
        await Promise.all([load(slug), load(slug)]);
        return React.createElement("p", null, slug);
      }

      async function renderRequest(slug) {
        const stream = renderToReadableStream(React.createElement(Request, { slug }), {});
        await new Response(stream).text();
      }

      await renderRequest("same-slug");
      if (calls !== 1) throw new Error(\`expected one call in request, received \${calls}\`);
      await renderRequest("same-slug");
      if (calls !== 2) throw new Error(\`expected request cache reset, received \${calls}\`);
      process.stdout.write("request-cache-ok");
    `;

    const output = execFileSync(
      process.execPath,
      ["--conditions=react-server", "--input-type=module", "--eval", script],
      { encoding: "utf8" },
    );

    expect(output).toBe("request-cache-ok");
  });
});
