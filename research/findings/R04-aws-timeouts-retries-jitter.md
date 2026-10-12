---
id: R4
title: AWS timeouts, retries, backoff with jitter
researcher: research agent (Claude)
read_on: 2026-10-06
sources:
  - url: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
    page_last_updated: "Published Jun 12, 2026; Last modified Jun 15, 2026 (as shown on redirected page)"
    redirected_to: https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter (canonical; different host, AWS Builder Center)
  - url: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
    page_last_updated: "Published 04 MAR 2015; modified 2023-05-03 (page metadata; 'Update (May 2023)' banner)"
    redirected_to: no
---
## Q1. How AWS chooses timeout values (percentile approach).
**Answer:** Set a timeout on every remote call, and generally on every cross-process call even on the same machine; this covers both the connection timeout and the request timeout. To pick a value, start from the downstream service's latency metrics. Choose an acceptable rate of false timeouts, for example 0.1%, and use the matching latency percentile, here p99.9.\[11\] The article lists four caveats:
- Over the internet, allow for a reasonable worst-case network latency.\[11\]
- When p99.9 is close to p50, add some padding.\[11\]
- Linux `SO_RCVTIMEO` is not a good end-to-end socket timeout.\[11\]
- Make sure the timeout covers DNS and TLS handshakes.\[11\]

The worked example is a 20 ms timeout that fired after deployments because TLS connection setup was counted inside it. AWS fixed it by setting up connections at process start, before the process took traffic.\[11\]
**Exact:** "acceptable rate of false timeouts (such as 0.1%)"; "p99.9 in this example"
**Where:** Builders' Library → "Timeouts"
## Q2. Why retries are "selfish" and can amplify load; what they say about retrying at multiple layers.
**Answer:** A retry spends more of the server's time to raise the client's own chance of success. That's fine when failures are rare. When failures come from overload, retries add load, can make things much worse, and can delay recovery. On layers: in a five-deep call stack with three tries at each layer, load on the database rises 243x. AWS's practice is to retry at a single point in the stack.\[11\]
**Exact:** "the load on the database will increase 243x"; "our best practice is to retry at a single point in the stack"\[11\]
**Where:** Builders' Library → "Retries and backoff"
## Q3. Advice on limiting retries (token bucket / retry budget, max attempts).
**Answer:**
- Use capped exponential backoff, and limit the number of retries so that failures are handled earlier.\[11\]
- Instead of circuit breakers, which bring modal behaviour that is hard to test, rate-limit retries locally with a token bucket. Every call can retry while tokens remain; after that, retries happen at a fixed rate. This has been built into the AWS SDK since 2016.\[11\]
- Retry only when the dependency looks healthy, and stop when retries aren't improving availability.\[11\]

The article gives no fixed maximum number of attempts.
**Exact:** "limiting retries locally using a token bucket"; "AWS added this behavior to the AWS SDK in 2016."\[11\]
**Where:** Builders' Library → "Retries and backoff", "Conclusion"
## Q4. Copy the jitter formulas/pseudocode from the blog: "Full Jitter", "Equal Jitter", "Decorrelated Jitter", and which one the blog concludes is best.
**Answer:** The formulas could not be copied: the blog shows them only as images (figures 3, 6, 10 and 11), and the page text contains none of them. Per Rule 2 this is NOT FOUND ON PAGE as text. The text around the images does say:
- **Full Jitter** is the jittered sleep from the "Adding Jitter" section.\[12\]
- **Equal Jitter** "always keep[s] some of the backoff and jitter by a smaller amount", to prevent very short sleeps.\[12\]
- **Decorrelated Jitter** is "similar to 'Full Jitter', but we also increase the maximum jitter based on the last random value."\[12\]\[13\]

Conclusion: no-jitter backoff is "the clear loser", and of the jittered versions "Equal Jitter" loses. Between Decorrelated and Full the call is "less clear": Full Jitter does less work but takes slightly more time. Both cut client work and server load substantially.\[12\] The blog does not name a single winner.
**Exact:** NOT FOUND ON PAGE (as text; formulas are images)
**Where:** blog → "Adding Backoff", "Adding Jitter"
## Q5. Which operations are safe to retry (idempotency).
**Answer:** APIs with side effects are not safe to retry unless they are idempotent. Read-only APIs usually are idempotent. Resource-creation APIs may not be. Some APIs, like EC2 `RunInstances`, offer token-based idempotency so they can be retried safely. HTTP client errors (4xx) shouldn't be retried unchanged, while server errors (5xx) may succeed later. Eventual consistency blurs that line.\[11\]
**Where:** Builders' Library → "Retries and backoff" ("Deciding when to retry", "Knowing which failures are worth retrying")
## Official code samples (only if a question asked for one)
The jitter pseudocode is on the page only as images (blog figures 3, 6, 10, 11), so no text could be copied verbatim. Someone needs to look at the images and type the formulas in by hand.
## Could not verify
- The verbatim Full, Equal and Decorrelated formulas, because they are images. The simulator code is on GitHub (`aws-arch-backoff-simulator`),\[12\] but that is not the listed page, so it was not used.
- The Builders' Library URL redirects to a different host (builder.aws.com),\[11\] which goes slightly beyond Rule 1's "same site". It is AWS's official page. The author is Marc Brooker, Senior Principal Engineer at AWS, per the AWS Architecture Blog post "re:Invent 2019: Introducing the Amazon Builders' Library (Part I)". The article first appeared with the Builders' Library launch at re:Invent 2019, so the Jun 2026 date on builder.aws.com is a re-hosting date, not the original publication date.
## Surprises
- The Builders' Library article now lives on the AWS Builder Center with a 2026 publish date,\[11\] even though the content is the long-standing version.
- The blog's May 2023 banner says most AWS SDKs already do exponential backoff with jitter in "standard" or "adaptive" retry modes.\[12\]
- The article says to jitter all timers and periodic jobs, and to use a jitter that is the same each time on a given host rather than random, so problems show up as patterns.\[11\]

## Review
- **Verdict:** accepted with gaps, and the main gap is now closed (see Addendum).
- **Reviewed:** 2026-10-12, by Claude in the bento-academy session.
- **Link to use in lessons:** the Builders' Library article now lives at https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter (the old aws.amazon.com URL redirects there).
- **Ignore:** footnote 13 (elasticdog.com) is a third-party copy of the blog. The same Decorrelated Jitter wording is on the AWS blog itself (footnote 12), so nothing is lost.
- **Follow-ups:** none.

## Addendum: jitter formulas (added 2026-10-12)
The blog shows its formulas only as images. The simulator it links to is AWS's own code, so the formulas are copied from there:
`https://raw.githubusercontent.com/awslabs/aws-arch-backoff-simulator/master/src/backoff_simulator.py` (read 2026-10-12).

```python
def expo(self, n):
    return min(self.cap, pow(2, n)*self.base)

# Equal Jitter
v = self.expo(n)
return v/2 + random.uniform(0, v/2)

# Full Jitter
v = self.expo(n)
return random.uniform(0, v)

# Decorrelated Jitter (self.sleep starts at self.base)
self.sleep = min(self.cap, random.uniform(self.base, self.sleep * 3))
return self.sleep
```
In words:
- **Full:** sleep a random time between 0 and the capped exponential.
- **Equal:** sleep half of it, plus a random time up to the other half.
- **Decorrelated:** sleep a random time between `base` and 3× the previous sleep, capped.

## Footnotes (numbering kept from the original export)

11. [Timeouts, retries, and backoff with jitter | AWS Builder Center](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter)
12. [Exponential Backoff And Jitter | Amazon Web Services](https://aws.amazon.com/blogs//architecture/exponential-backoff-and-jitter/)
13. [Exponential Backoff and Jitter](https://www.elasticdog.com/Exponential-Backoff-and-Jitter)
