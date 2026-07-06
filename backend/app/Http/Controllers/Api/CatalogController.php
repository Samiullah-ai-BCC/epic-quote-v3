<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\UserCatalogItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Team catalog: custom sign types (with reusable spec templates) and uploaded side views.
 * Shared across every user and both quote modes — add once, available everywhere.
 */
class CatalogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['kind' => 'required|in:sign_type,side_view']);

        return response()->json(
            UserCatalogItem::where('kind', $request->query('kind'))
                ->orderBy('name')
                ->get(['id', 'kind', 'name', 'data'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => 'required|in:sign_type,side_view',
            'name' => 'required|string|max:160',
            'data' => 'nullable|array',
        ]);
        $name = trim(mb_strtoupper($data['name']));
        if ($name === '') {
            return response()->json(['error' => 'Name is required.'], 422);
        }

        $item = UserCatalogItem::updateOrCreate(
            ['kind' => $data['kind'], 'name' => $name],
            ['data' => $data['data'] ?? []]
        );
        ActivityLog::record($request->user()->id, 'catalog_saved', "{$data['kind']}: {$name}");

        return response()->json($item);
    }

    /** Upload a library file (side view etc.) not tied to any quote — permanent storage. */
    public function upload(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:pdf,jpg,jpeg,png,gif,webp,avif,svg|max:25600']);
        $file = $request->file('file');
        $filename = 'lib_'.substr(md5((string) microtime(true)), 0, 8).'_'.preg_replace('/[^A-Za-z0-9._-]/', '_', $file->getClientOriginalName());

        if (\App\Services\CloudinaryService::configured()) {
            $url = \App\Services\CloudinaryService::upload($file->getRealPath(), 'epic-quote/library', 'auto');
            if (!$url) {
                return response()->json(['error' => 'Cloudinary upload failed.'], 502);
            }
            return response()->json(['path' => $url]);
        }
        $file->storeAs('library', $filename, 'public');
        return response()->json(['path' => "/storage/library/{$filename}"]);
    }

    public function destroy(Request $request, UserCatalogItem $item): JsonResponse
    {
        ActivityLog::record($request->user()->id, 'catalog_deleted', "{$item->kind}: {$item->name}");
        $item->delete();

        return response()->json(['ok' => true]);
    }
}
