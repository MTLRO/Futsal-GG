# 🌐 DNS Setup Guide for futsalgg.com

## Step 1: Access Your Domain Registrar

Go to the website where you registered `futsalgg.com` (e.g., GoDaddy, Namecheap, Google Domains, etc.)

---

## Step 2: Add DNS Records

Navigate to DNS Management / DNS Settings and add these records:

### Record 1: Root Domain

| Field | Value |
|-------|-------|
| **Type** | A |
| **Name/Host** | `@` (or leave blank) |
| **Value/Points to** | `38.102.86.90` |
| **TTL** | `300` (or Auto) |

This points `futsalgg.com` to your VPS.

### Record 2: WWW Subdomain

| Field | Value |
|-------|-------|
| **Type** | A |
| **Name/Host** | `www` |
| **Value/Points to** | `38.102.86.90` |
| **TTL** | `300` (or Auto) |

This points `www.futsalgg.com` to your VPS.

---

## Step 3: Save Changes

Click "Save" or "Add Record" to apply the changes.

**⏱️ Wait Time:** DNS propagation typically takes 5-15 minutes, but can take up to 48 hours.

---

## Step 4: Verify DNS is Working

After waiting 5-10 minutes, test from your VPS:

```bash
# Test root domain
nslookup futsalgg.com

# Should show:
# Name:   futsalgg.com
# Address: 38.102.86.90

# Test www subdomain
nslookup www.futsalgg.com

# Should show:
# Name:   www.futsalgg.com
# Address: 38.102.86.90
```

Or test from any computer:

```bash
ping futsalgg.com
# Should ping 38.102.86.90
```

---

## Common DNS Providers

### GoDaddy
1. Login → My Products → DNS
2. Click "Add" under Records
3. Add the A records as shown above

### Namecheap
1. Login → Domain List → Manage
2. Advanced DNS tab
3. Add New Record → A Record
4. Add both records

### Google Domains
1. Login → My Domains → Manage
2. DNS tab → Custom resource records
3. Add the A records

### Cloudflare
1. Login → Select domain
2. DNS tab
3. Add record → Type: A
4. Add both records
5. **Important:** Set proxy status to "DNS only" (grey cloud)

---

## ✅ After DNS is Working

Once `nslookup futsalgg.com` returns `38.102.86.90`, you can:

1. **Start Docker services** on VPS
2. **Run SSL setup** to get HTTPS certificate
3. **Access your site** at https://futsalgg.com

---

## 🐛 Troubleshooting

### DNS Not Resolving?

```bash
# Check current DNS records
dig futsalgg.com

# Check with specific DNS server
nslookup futsalgg.com 8.8.8.8
```

### Still Not Working After 1 Hour?

1. Double-check the IP address is correct: `38.102.86.90`
2. Make sure you saved the DNS records
3. Check if your domain registrar has nameservers pointing elsewhere
4. Try clearing your local DNS cache:
   ```bash
   # Windows
   ipconfig /flushdns

   # Mac/Linux
   sudo dscacheutil -flushcache
   ```

### Using Cloudflare?

If you use Cloudflare as your DNS provider:
- Set the cloud to **grey** (DNS only), not orange (proxied)
- Orange cloud will interfere with Let's Encrypt SSL setup initially

---

## 📝 Summary

| Domain | Points To | Purpose |
|--------|-----------|---------|
| `futsalgg.com` | `38.102.86.90` | Main domain |
| `www.futsalgg.com` | `38.102.86.90` | WWW subdomain |

Both will work after DNS propagates!

---

## Next Steps

After DNS is working:

1. ✅ Create `.env` file on VPS
2. ✅ Start Docker services
3. ✅ Run SSL setup script
4. ✅ Access https://futsalgg.com

See [DEPLOYMENT_STEPS.md](./DEPLOYMENT_STEPS.md) for complete deployment guide.
