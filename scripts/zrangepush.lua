-- KEYS:[from, to], ARGV:[min, max, remove]
local refs = redis.call("zrangebyscore", KEYS[1], ARGV[1], ARGV[2])
for i,ref in pairs(refs) do
  redis.call("lpush", KEYS[2], ref)
end
if ARGV[3] then
  redis.call("zremrangebyscore", KEYS[1], ARGV[1], ARGV[2])
end
return refs