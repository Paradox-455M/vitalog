package repository

import (
	"context"
	"fmt"
	"net"

	"github.com/jackc/pgx/v5/pgxpool"
)

// dialPreferIPv4 dials Postgres after resolving the host. IPv4 addresses are
// tried first, then IPv6. This avoids "no route to host" failures when DNS
// returns IPv6 first but the local network cannot reach Supabase over IPv6
// (a common setup with residential or corporate networks).
func dialPreferIPv4(ctx context.Context, network, addr string) (net.Conn, error) {
	var d net.Dialer
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return d.DialContext(ctx, network, addr)
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return d.DialContext(ctx, network, addr)
	}
	var v4s, v6s []net.IP
	for _, ip := range ips {
		if b4 := ip.IP.To4(); b4 != nil {
			v4s = append(v4s, b4)
		} else {
			v6s = append(v6s, ip.IP)
		}
	}
	ordered := append(v4s, v6s...)
	var firstErr error
	for _, ip := range ordered {
		tcpAddr := net.JoinHostPort(ip.String(), port)
		c, dialErr := d.DialContext(ctx, "tcp", tcpAddr)
		if dialErr == nil {
			return c, nil
		}
		if firstErr == nil {
			firstErr = dialErr
		}
	}
	if firstErr != nil {
		return nil, firstErr
	}
	return d.DialContext(ctx, network, addr)
}

func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	config.ConnConfig.DialFunc = dialPreferIPv4

	config.MaxConns = 10
	config.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return pool, nil
}
