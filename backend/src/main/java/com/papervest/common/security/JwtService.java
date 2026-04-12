package com.papervest.common.security;

import com.papervest.common.config.AppSecurityProperties;
import com.papervest.common.exception.AuthenticationException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
public class JwtService {

	private final JwtEncoder jwtEncoder;
	private final JwtDecoder jwtDecoder;
	private final AppSecurityProperties properties;
	private final Clock clock;

	public JwtService(JwtEncoder jwtEncoder, JwtDecoder jwtDecoder, AppSecurityProperties properties, Clock clock) {
		this.jwtEncoder = jwtEncoder;
		this.jwtDecoder = jwtDecoder;
		this.properties = properties;
		this.clock = clock;
	}

	public AccessToken createAccessToken(UUID userId, String email) {
		Instant issuedAt = clock.instant();
		Instant expiresAt = issuedAt.plus(properties.accessTokenTtl());

		JwtClaimsSet claimsSet = JwtClaimsSet.builder()
				.issuer("papervest-backend")
				.subject(userId.toString())
				.issuedAt(issuedAt)
				.expiresAt(expiresAt)
				.claim("email", email)
				.build();

		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
		String tokenValue = jwtEncoder.encode(JwtEncoderParameters.from(header, claimsSet)).getTokenValue();

		return new AccessToken(tokenValue, expiresAt);
	}

	public AuthenticatedUser parseAccessToken(String token) {
		try {
			Jwt jwt = jwtDecoder.decode(token);
			return new AuthenticatedUser(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("email"));
		}
		catch (JwtException | IllegalArgumentException ex) {
			throw new AuthenticationException("Invalid or expired access token");
		}
	}

	public record AccessToken(String tokenValue, Instant expiresAt) {
	}
}
