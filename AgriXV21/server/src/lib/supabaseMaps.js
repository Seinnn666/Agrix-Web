function pick(obj, keys) {
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

function asString(v) {
  return v === null || v === undefined ? '' : String(v);
}

function pickNonEmpty(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return undefined;
}

function asIsoString(v) {
  if (v === null || v === undefined || v === '') return '';
  const date = new Date(v);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

export function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (!s) return false;
    if (s === 'true' || s === 't' || s === '1' || s === 'yes' || s === 'y') return true;
    if (s === 'false' || s === 'f' || s === '0' || s === 'no' || s === 'n' || s === 'null' || s === 'undefined') return false;
  }
  return Boolean(v);
}

function asBool(v) {
  return parseBool(v);
}

function resolveRole(u) {
  if (parseBool(pick(u, ['isAdmin', 'is_admin']))) return 'admin';
  return 'user';
}

function asDateOnlyString(v) {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch (_err) {
    return '';
  }
}

export function userRowToPublic(u) {
  const id = asString(pick(u, ['id', '_id']));
  return {
    _id: id,
    id,
    firstName: asString(pick(u, ['firstName', 'first_name'])),
    lastName: asString(pick(u, ['lastName', 'last_name'])),
    phone: asString(pick(u, ['phone'])),
    email: asString(pick(u, ['email'])),
    address: asString(pick(u, ['address'])),
    dateOfBirth: asDateOnlyString(pick(u, ['dateOfBirth', 'date_of_birth'])),
    gender: asString(pick(u, ['gender'])) || 'rather_not_say',
    avatarUrl: asString(pick(u, ['avatarUrl', 'avatar_url'])),
    emailVerified: asBool(pick(u, ['emailVerified', 'email_verified'])),
    phoneVerified: asBool(pick(u, ['phoneVerified', 'phone_verified'])),
    isAdmin: asBool(pick(u, ['isAdmin', 'is_admin'])),
    role: resolveRole(u),
  };
}

export function userRowToAdminDto(u) {
  const firstName = asString(pickNonEmpty(u, ['firstName', 'first_name', 'givenName', 'given_name']));
  const lastName = asString(pickNonEmpty(u, ['lastName', 'last_name', 'familyName', 'family_name']));
  const storedName = asString(pickNonEmpty(u, ['fullName', 'full_name', 'name'])).trim();
  const createdAt = asIsoString(pickNonEmpty(u, ['createdAt', 'created_at', 'joinedAt', 'joined_at']));
  const updatedAt = asIsoString(pickNonEmpty(u, ['updatedAt', 'updated_at']));
  return {
    _id: asString(pick(u, ['id', '_id'])),
    id: asString(pick(u, ['id', '_id'])),
    firstName,
    lastName,
    fullName: storedName || `${firstName} ${lastName}`.trim(),
    phone: asString(pick(u, ['phone'])),
    email: asString(pick(u, ['email'])),
    address: asString(pick(u, ['address'])),
    dateOfBirth: asString(pick(u, ['dateOfBirth', 'date_of_birth'])) || '',
    gender: asString(pick(u, ['gender'])) || '',
    avatarUrl: asString(pick(u, ['avatarUrl', 'avatar_url'])) || '',
    emailVerified: asBool(pick(u, ['emailVerified', 'email_verified'])),
    phoneVerified: asBool(pick(u, ['phoneVerified', 'phone_verified'])),
    isAdmin: asBool(pick(u, ['isAdmin', 'is_admin'])),
    role: resolveRole(u),
    createdAt,
    updatedAt: updatedAt || createdAt,
  };
}

export function farmRowToDto(f) {
  const ownerObj = pick(f, ['owner', 'users', 'user']);
  const owner =
    ownerObj && typeof ownerObj === 'object'
      ? {
          _id: asString(pick(ownerObj, ['id', '_id'])),
          id: asString(pick(ownerObj, ['id', '_id'])),
          firstName: asString(pick(ownerObj, ['firstName', 'first_name'])),
          lastName: asString(pick(ownerObj, ['lastName', 'last_name'])),
          email: asString(pick(ownerObj, ['email'])),
          avatarUrl: asString(pick(ownerObj, ['avatarUrl', 'avatar_url'])),
        }
      : undefined;

  const id = asString(pick(f, ['id', '_id']));
  return {
    _id: id,
    id,
    owner: owner || asString(pick(f, ['owner', 'owner_id'])),
    name: asString(pick(f, ['name'])),
    location: asString(pick(f, ['location'])),
    description: asString(pick(f, ['description'])),
    imageUrl: asString(pick(f, ['imageUrl', 'image_url'])),
    snapshots: Array.isArray(pick(f, ['snapshots'])) ? pick(f, ['snapshots']) : [],
    crops: Array.isArray(pick(f, ['crops'])) ? pick(f, ['crops']) : [],
    createdAt: pick(f, ['createdAt', 'created_at']) ? new Date(pick(f, ['createdAt', 'created_at'])).toISOString() : '',
    updatedAt: pick(f, ['updatedAt', 'updated_at']) ? new Date(pick(f, ['updatedAt', 'updated_at'])).toISOString() : '',
  };
}

export function farmApplicationRowToDto(a) {
  const farmObj = pick(a, ['farm', 'farms']);
  const applicantObj = pick(a, ['applicant', 'users']);
  const id = asString(pick(a, ['id', '_id']));
  return {
    _id: id,
    id,
    farm: farmObj && typeof farmObj === 'object' ? farmRowToDto(farmObj) : asString(pick(a, ['farm', 'farm_id'])),
    applicant:
      applicantObj && typeof applicantObj === 'object'
        ? userRowToPublic(applicantObj)
        : asString(pick(a, ['applicant', 'applicant_id'])),
    status: asString(pick(a, ['status'])) || 'pending',
    message: asString(pick(a, ['message'])),
    createdAt: pick(a, ['createdAt', 'created_at']) ? new Date(pick(a, ['createdAt', 'created_at'])).toISOString() : '',
    updatedAt: pick(a, ['updatedAt', 'updated_at']) ? new Date(pick(a, ['updatedAt', 'updated_at'])).toISOString() : '',
  };
}
