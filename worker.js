export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /*
     * Submit a URL for scanning
     */
    if (url.pathname === "/api/scan-url" && request.method === "POST") {
      try {
        const body = await request.json();
        const targetUrl = body?.url;

        if (!targetUrl) {
          return Response.json(
            { error: "URL is required." },
            { status: 400 }
          );
        }

        let parsedUrl;

        try {
          parsedUrl = new URL(targetUrl);
        } catch {
          return Response.json(
            { error: "Please enter a valid URL." },
            { status: 400 }
          );
        }

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          return Response.json(
            { error: "Only HTTP and HTTPS URLs are allowed." },
            { status: 400 }
          );
        }

        const formData = new URLSearchParams();
        formData.set("url", targetUrl);

        const scanResponse = await fetch(
          "https://www.virustotal.com/api/v3/urls",
          {
            method: "POST",
            headers: {
              "x-apikey": env.VIRUSTOTAL_API_KEY,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData.toString()
          }
        );

        const scanData = await scanResponse.json();

        if (!scanResponse.ok) {
          return Response.json(
            {
              error: "VirusTotal rejected the scan request.",
              details: scanData
            },
            { status: scanResponse.status }
          );
        }

        return Response.json({
          success: true,
          analysisId: scanData?.data?.id || null
        });

      } catch (error) {
        return Response.json(
          {
            error: "Scanner error.",
            message:
              error instanceof Error
                ? error.message
                : "Unknown error"
          },
          { status: 500 }
        );
      }
    }

    /*
     * Check the status of an existing VirusTotal analysis
     */
    if (url.pathname === "/api/scan-status" && request.method === "GET") {
      try {
        const analysisId = url.searchParams.get("id");

        if (!analysisId) {
          return Response.json(
            { error: "Analysis ID is required." },
            { status: 400 }
          );
        }

        const analysisResponse = await fetch(
          `https://www.virustotal.com/api/v3/analyses/${encodeURIComponent(analysisId)}`,
          {
            method: "GET",
            headers: {
              "x-apikey": env.VIRUSTOTAL_API_KEY
            }
          }
        );

        const analysisData = await analysisResponse.json();

        if (!analysisResponse.ok) {
          return Response.json(
            {
              error: "Unable to retrieve scan status.",
              details: analysisData
            },
            { status: analysisResponse.status }
          );
        }

        const attributes =
          analysisData?.data?.attributes || {};

        return Response.json({
          success: true,
          status: attributes.status || "unknown",
          stats: attributes.stats || null
        });

      } catch (error) {
        return Response.json(
          {
            error: "Status check failed.",
            message:
              error instanceof Error
                ? error.message
                : "Unknown error"
          },
          { status: 500 }
        );
      }
    }

    /*
     * Everything else goes to the existing website.
     */
    return env.ASSETS.fetch(request);
  }
};
