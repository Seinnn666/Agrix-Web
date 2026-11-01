import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth.js';
import { getSupabaseAdmin, newObjectId } from '../lib/db.js';
import { farmApplicationRowToDto, farmRowToDto, userRowToPublic } from '../lib/supabaseMaps.js';

const router = express.Router();

function toUniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const v of values || []) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function indexById(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const id = String(r?._id || r?.id || '').trim();
    if (!id) continue;
    map.set(id, r);
  }
  return map;
}

// Configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// --- Farm Routes ---

// Get all farms (with optional search)
router.get('/', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const search = String(req.query.search || '').trim();

    let query = supabase.from('farms').select('*').order('createdAt', { ascending: false });
    if (search) {
      const safe = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`name.ilike.%${safe}%,location.ilike.%${safe}%,description.ilike.%${safe}%`);
    }

    const { data: farms, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to fetch farms' });

    const ownerIds = toUniqueStrings((farms || []).map((f) => f?.owner));
    const { data: owners, error: ownersErr } = ownerIds.length
      ? await supabase.from('users').select('_id,firstName,lastName,email,avatarUrl').in('_id', ownerIds)
      : { data: [], error: null };
    if (ownersErr) return res.status(500).json({ error: 'Failed to fetch farms' });

    const ownersById = indexById(owners);
    const enriched = (farms || []).map((f) => {
      const ownerRow = ownersById.get(String(f?.owner || ''));
      if (!ownerRow) return farmRowToDto(f);
      return farmRowToDto({ ...f, owner: userRowToPublic(ownerRow) });
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch farms' });
  }
});

// Get the authenticated user's farm
router.get('/my-farm', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: farm, error } = await supabase.from('farms').select('*').eq('owner', req.userId).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to fetch farm' });
    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }
    res.json(farmRowToDto(farm));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch farm' });
  }
});

// Create a farm for the authenticated user
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, location, description, crops } = req.body;
    
    // Check if user already has a farm
    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingErr } = await supabase
      .from('farms')
      .select('_id')
      .eq('owner', req.userId)
      .maybeSingle();
    if (existingErr) return res.status(500).json({ error: 'Failed to create farm' });
    if (existing) {
      return res.status(400).json({ error: 'You already have a registered farm' });
    }

    const { data: farm, error } = await supabase
      .from('farms')
      .insert({
        _id: newObjectId(),
        owner: req.userId,
        name,
        location,
        description,
        crops: Array.isArray(crops) ? crops : [],
        snapshots: [],
      })
      .select('*')
      .single();
    if (error || !farm) return res.status(500).json({ error: 'Failed to create farm' });
    
    res.status(201).json(farmRowToDto(farm));
  } catch (err) {
    res.status(500).json({ error: 'Failed to create farm' });
  }
});

// Upload snapshot
router.post('/snapshots', requireAuth, upload.single('snapshot'), async (req, res) => {
  console.log('POST /snapshots hit');
  console.log('Headers:', req.headers);
  console.log('File:', req.file);
  console.log('Body:', req.body);

  try {
    if (!req.file) {
      console.error('No file uploaded (req.file is undefined)');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    console.log('File URL:', fileUrl);
    
    const supabase = getSupabaseAdmin();
    const { data: farm, error: farmErr } = await supabase
      .from('farms')
      .select('*')
      .eq('owner', req.userId)
      .maybeSingle();
    if (farmErr) return res.status(500).json({ error: 'Failed to upload snapshot' });
    
    if (!farm) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Farm not found' });
    }

    const nextSnapshots = Array.isArray(farm.snapshots) ? [...farm.snapshots, fileUrl] : [fileUrl];
    const { data: updated, error: updateErr } = await supabase
      .from('farms')
      .update({ snapshots: nextSnapshots })
      .eq('_id', farm._id)
      .select('*')
      .single();
    if (updateErr || !updated) return res.status(500).json({ error: 'Failed to upload snapshot' });
    
    res.json(farmRowToDto(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload snapshot' });
  }
});

// Delete snapshot
router.delete('/snapshots', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Snapshot URL is required' });
    }

    // Extract filename from URL to delete from filesystem
    const filename = url.split('/').pop();
    const filePath = path.join('uploads', filename);

    const supabase = getSupabaseAdmin();
    const { data: farm, error: farmErr } = await supabase
      .from('farms')
      .select('*')
      .eq('owner', req.userId)
      .maybeSingle();
    if (farmErr) return res.status(500).json({ error: 'Failed to delete snapshot' });

    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const nextSnapshots = (Array.isArray(farm.snapshots) ? farm.snapshots : []).filter((s) => s !== url);
    const { data: updated, error: updateErr } = await supabase
      .from('farms')
      .update({ snapshots: nextSnapshots })
      .eq('_id', farm._id)
      .select('*')
      .single();
    if (updateErr || !updated) return res.status(500).json({ error: 'Failed to delete snapshot' });

    // Delete from filesystem if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json(farmRowToDto(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete snapshot' });
  }
});

// Update farm
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, location, description, crops } = req.body;
    const supabase = getSupabaseAdmin();
    const { data: farm, error } = await supabase
      .from('farms')
      .update({
        name,
        location,
        description,
        crops: Array.isArray(crops) ? crops : [],
      })
      .eq('_id', req.params.id)
      .eq('owner', req.userId)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to update farm' });
    if (!farm) return res.status(404).json({ error: 'Farm not found or unauthorized' });
    res.json(farmRowToDto(farm));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update farm' });
  }
});

// --- Application Routes ---

// Apply to a farm as the authenticated user
router.post('/:id/apply', requireAuth, async (req, res) => {
  try {
    const farmId = req.params.id;
    const { message } = req.body;

    // Check if already applied
    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingErr } = await supabase
      .from('farmapplications')
      .select('_id')
      .eq('farm', farmId)
      .eq('applicant', req.userId)
      .maybeSingle();
    if (existingErr) return res.status(500).json({ error: 'Failed to submit application' });
    if (existing) {
      return res.status(400).json({ error: 'You have already applied to this farm' });
    }

    const { data: application, error } = await supabase
      .from('farmapplications')
      .insert({
        _id: newObjectId(),
        farm: farmId,
        applicant: req.userId,
        message: String(message || ''),
        status: 'pending',
      })
      .select('*')
      .single();
    if (error || !application) return res.status(500).json({ error: 'Failed to submit application' });

    res.status(201).json(farmApplicationRowToDto(application));
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Get applications for the authenticated user's farm
router.get('/my-farm/applications', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: farm, error: farmErr } = await supabase.from('farms').select('*').eq('owner', req.userId).maybeSingle();
    if (farmErr) return res.status(500).json({ error: 'Failed to fetch applications' });
    if (!farm) return res.status(404).json({ error: 'Farm not found' });

    const { data: applications, error } = await supabase
      .from('farmapplications')
      .select('*')
      .eq('farm', farm._id)
      .order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to fetch applications' });

    const applicantIds = toUniqueStrings((applications || []).map((a) => a?.applicant));
    const { data: applicants, error: applicantsErr } = applicantIds.length
      ? await supabase.from('users').select('_id,firstName,lastName,email,phone,avatarUrl').in('_id', applicantIds)
      : { data: [], error: null };
    if (applicantsErr) return res.status(500).json({ error: 'Failed to fetch applications' });

    const applicantsById = indexById(applicants);
    const enriched = (applications || []).map((a) => {
      const applicantRow = applicantsById.get(String(a?.applicant || ''));
      if (!applicantRow) return farmApplicationRowToDto(a);
      return farmApplicationRowToDto({ ...a, applicant: userRowToPublic(applicantRow) });
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get applications submitted by the authenticated user
router.get('/my-applications', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: applications, error } = await supabase
      .from('farmapplications')
      .select('*')
      .eq('applicant', req.userId)
      .order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to fetch applications' });

    const farmIds = toUniqueStrings((applications || []).map((a) => a?.farm));
    const { data: farms, error: farmsErr } = farmIds.length
      ? await supabase.from('farms').select('*').in('_id', farmIds)
      : { data: [], error: null };
    if (farmsErr) return res.status(500).json({ error: 'Failed to fetch applications' });

    const farmsById = indexById(farms);
    const enriched = (applications || []).map((a) => {
      const farmRow = farmsById.get(String(a?.farm || ''));
      if (!farmRow) return farmApplicationRowToDto(a);
      return farmApplicationRowToDto({ ...a, farm: farmRowToDto(farmRow) });
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Accept or reject an application for the authenticated user's farm
router.patch('/applications/:id', requireAuth, async (req, res) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const applicationId = req.params.id;
    const supabase = getSupabaseAdmin();
    const { data: application, error: appErr } = await supabase
      .from('farmapplications')
      .select('*')
      .eq('_id', applicationId)
      .maybeSingle();
    if (appErr) return res.status(500).json({ error: 'Failed to update application' });
    
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const { data: farm, error: farmErr } = await supabase.from('farms').select('*').eq('_id', application.farm).maybeSingle();
    if (farmErr) return res.status(500).json({ error: 'Failed to update application' });
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    if (String(farm.owner || '') !== String(req.userId)) return res.status(403).json({ error: 'Unauthorized' });

    const { data: updated, error } = await supabase
      .from('farmapplications')
      .update({ status })
      .eq('_id', applicationId)
      .select('*')
      .single();
    if (error || !updated) return res.status(500).json({ error: 'Failed to update application' });
    res.json(farmApplicationRowToDto(updated));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update application' });
  }
});

export default router;
