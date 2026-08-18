export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // URL scanner API
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

        // Basic URL validation
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

        // Send URL to VirusTotal
        const formData = new URLSearchParams();
        formData.set("url", targetUrl);

        const vtResponse = await fetch(
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

        const vtData = await vtResponse.json();

        if (!vtResponse.ok) {
          return Response.json(
            {
              error: "VirusTotal rejected the scan request.",
              details: vtData
            },
            { status: vtResponse.status }
          );
        }

        return Response.json({
          success: true,
          analysisId: vtData?.data?.id || null
        });

      } catch (error) {
        return Response.json(
          {
            error: "Scanner error.",
            message: error instanceof Error ? error.message : "Unknown error"
          },
          { status: 500 }
        );
      }
    }

    // Everything else goes to your existing website
    return env.ASSETS.fetch(request);
  }
};
