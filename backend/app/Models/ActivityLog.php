<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    use HasFactory;

    protected $table = 'activity_log';

    // V1 only tracks created_at
    const UPDATED_AT = null;

    protected $fillable = ['user_id', 'action', 'details'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // V1 log_activity(user_id, action, details)
    public static function record(?int $userId, string $action, string $details = ''): void
    {
        static::create([
            'user_id' => $userId,
            'action'  => $action,
            'details' => $details,
        ]);
    }
}
