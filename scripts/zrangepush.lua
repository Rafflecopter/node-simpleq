-- KEYS:[from, to], ARGV:[min, max]
local refs = redis.call("zrangebyscore", KEYS[1], ARGV[1], ARGV[2])
for i,ref in pairs(refs) do
  redis.call("lpush", KEYS[2], ref)
end
redis.call("zremrangebyscore", KEYS[1], ARGV[1], ARGV[2])
return refs