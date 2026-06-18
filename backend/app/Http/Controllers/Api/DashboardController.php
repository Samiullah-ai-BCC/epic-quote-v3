<?php

namespace App\Http\Controllers\Api;

use App\Constants\AppConstants;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Order;
use App\Models\Quote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    // GET /api/dashboard — monthly stats + status cards (#38,#39)
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $now = Carbon::now();
        $monthStart = $now->copy()->startOfMonth();
        $nextMonth  = $now->copy()->startOfMonth()->addMonth();

        $base = fn () => Quote::query()->visibleTo($user);

        $monthQuotes = $base()
            ->whereBetween('created_at', [$monthStart, $nextMonth])
            ->get();
        $allQuotes = $base()->get();

        // status counts seeded with all 10 statuses (#39 clickable cards)
        $statusCounts = array_fill_keys(AppConstants::STATUS_OPTIONS, 0);
        foreach ($allQuotes as $q) {
            if (array_key_exists($q->status, $statusCounts)) {
                $statusCounts[$q->status]++;
            }
        }

        $totalQuotesMonth = $monthQuotes->count();
        $totalAmountMonth = (float) $monthQuotes->sum('price');

        $ordersQuery = Order::query()
            ->join('quotes', 'orders.quote_id', '=', 'quotes.id')
            ->when(!$user->isAdmin(), fn ($qq) => $qq->where('quotes.sales_rep', $user->full_name));

        $ordersMonth = (clone $ordersQuery)
            ->whereBetween('orders.confirmed_at', [$monthStart, $nextMonth])
            ->count();

        $conversion = $totalQuotesMonth ? ($ordersMonth / $totalQuotesMonth * 100) : 0;

        $totalSalesValue = (float) (clone $ordersQuery)->sum('orders.total_value');

        $pendingCount = $allQuotes->where('status', '!=', 'Done')->count();

        return response()->json([
            'month_label' => $now->format('F Y'),
            'cards'       => $statusCounts,
            'totals'      => [
                'total_quotes_month' => $totalQuotesMonth,
                'total_amount_month' => $totalAmountMonth,
            ],
            'reports' => [
                'total_quotes_created'   => $totalQuotesMonth,
                'total_orders_confirmed' => $ordersMonth,
                'conversion_rate'        => round($conversion, 1),
                'total_sales_value'      => $totalSalesValue,
                'pending_count'          => $pendingCount,
            ],
        ]);
    }

    // GET /api/reports/sales-reps — admin only (#107)
    public function salesReps(Request $request): JsonResponse
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['error' => 'forbidden'], 403);
        }

        $now = Carbon::now();
        $weekStart  = $now->copy()->subDays(7);
        $monthStart = $now->copy()->startOfMonth();
        $nextMonth  = $now->copy()->startOfMonth()->addMonth();

        $repStats = function (string $rep, Carbon $start, Carbon $end): array {
            $quotes = Quote::where('sales_rep', $rep)
                ->whereBetween('created_at', [$start, $end])
                ->get();
            $received  = $quotes->count();
            $converted = $quotes->where('order_confirmed', true)->count();
            $rate = $received ? ($converted / $received * 100) : 0;
            return [
                'total_quotes_received' => $received,
                'quotes_converted'      => $converted,
                'conversion_rate'       => round($rate, 1),
            ];
        };

        $out = [];
        foreach (AppConstants::SALES_REPS as $rep) {
            $out[] = [
                'name'    => $rep,
                'weekly'  => $repStats($rep, $weekStart, $now),
                'monthly' => $repStats($rep, $monthStart, $nextMonth),
            ];
        }

        return response()->json($out);
    }

    // GET /api/activity — admin only, last 150 (#108)
    public function activity(Request $request): JsonResponse
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['error' => 'forbidden'], 403);
        }

        $logs = ActivityLog::with('user')
            ->latest('created_at')
            ->limit(150)
            ->get()
            ->map(fn ($l) => [
                'user'    => $l->user?->full_name ?? 'Unknown',
                'action'  => $l->action,
                'details' => $l->details,
                'at'      => $l->created_at?->toIso8601String(),
            ]);

        return response()->json($logs);
    }
}
