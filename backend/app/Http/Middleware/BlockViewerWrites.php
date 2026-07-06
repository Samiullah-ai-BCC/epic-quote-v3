<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Viewer accounts are strictly read-only: one guard covering EVERY write endpoint,
// present and future, instead of per-controller checks that can be forgotten.
class BlockViewerWrites
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && method_exists($user, 'isViewer') && $user->isViewer()
            && !in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return response()->json(['error' => 'Your account is view-only — ask an admin for edit access.'], 403);
        }
        return $next($request);
    }
}
