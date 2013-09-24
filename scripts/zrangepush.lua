-- KEYS:[from, to], ARGV:[min, max, remove]
local refs = redis.call("zrangebyscore", KEYS[1], ARGV[1], ARGV[2])
redis.call("lpush", KEYS[2], unpack(refs))
if ARGV[3] then
  redis.call("zremrangebyscore", KEYS[1], ARGV[1], ARGV[2])
end
return refs