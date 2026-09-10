-- Which WhatsApp templates are actually failing, and why.
--
-- Run against PRODUCTION (the local DB only has today's test rows). The
-- notification_logs table is the only place that records a real verdict from
-- MSG91: nexus patches `status` and `error_message` back through the callback
-- in core/nexus_notify.py.

-- 1. The headline: every template, by outcome, last 90 days.
SELECT template_name,
       status,
       provider,
       count(*)                                   AS n,
       max(created_at)                            AS last_seen
FROM notification_logs
WHERE channel = 'whatsapp'
  AND created_at > now() - interval '90 days'
GROUP BY template_name, status, provider
ORDER BY template_name, n DESC;

-- 2. Only the failures, with the reason MSG91 gave. A parameter-count
--    mismatch shows up here as a 400-class error naming the component.
SELECT template_name,
       error_message,
       count(*)      AS n,
       max(created_at) AS last_seen
FROM notification_logs
WHERE channel = 'whatsapp'
  AND status = 'failed'
  AND created_at > now() - interval '90 days'
GROUP BY template_name, error_message
ORDER BY n DESC;

-- 3. Templates that have NEVER succeeded. These are the ones worth checking
--    against Meta first: a template that has never once gone out is usually
--    registered with a different shape than the code sends.
SELECT template_name,
       count(*) FILTER (WHERE status = 'sent')      AS sent,
       count(*) FILTER (WHERE status = 'delivered') AS delivered,
       count(*) FILTER (WHERE status = 'failed')    AS failed,
       count(*) FILTER (WHERE status = 'queued')    AS still_queued
FROM notification_logs
WHERE channel = 'whatsapp'
GROUP BY template_name
HAVING count(*) FILTER (WHERE status IN ('sent', 'delivered')) = 0
ORDER BY failed DESC;

-- 4. Rows stuck at 'queued'. These mean the callback never landed, which is a
--    reporting failure rather than a delivery one — the message may well have
--    gone out. 159 of these existed before _close_log was added to
--    platform_notification_service.py.
SELECT template_name, count(*) AS stuck, max(created_at) AS last_seen
FROM notification_logs
WHERE channel = 'whatsapp' AND status = 'queued'
GROUP BY template_name
ORDER BY stuck DESC;
