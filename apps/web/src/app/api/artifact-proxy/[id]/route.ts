export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const upstream = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/artifacts/${params.id}/download`;
  const res = await fetch(upstream, {
    headers: { 'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY ?? '' },
    redirect: 'follow',
  });
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
    },
  });
}
