export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const url = body.url;

    if (!url) {
      return Response.json(
        { error: "Missing URL" },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: "URL received for scanning",
      url
    });
  } catch (error) {
    return Response.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
